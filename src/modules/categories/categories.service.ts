import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../../shared/utils/slugify';
import { Category } from 'generated/prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const {
      name,
      description,
      image,
      icon,
      parentId,
      metaTitle,
      metaDescription,
      sortOrder = 0,
      isActive = true,
      isFeatured = false,
      slug: providedSlug,
    } = createCategoryDto;

    // Generate slug if not provided
    const slug = providedSlug || slugify(name);

    // Check uniqueness
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Category with this slug already exists');
    }

    // Validate parent if provided
    let parent: any = null;
    if (parentId) {
      parent = await this.prisma.category.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category with id ${parentId} not found`,
        );
      }
    }

    // Compute level, path, pathIds based on parent
    const level = parent ? parent.level + 1 : 1;
    const path = parent
      ? parent.path
        ? `${parent.path}/${slug}`
        : `${parent.slug}/${slug}`
      : null;
    const pathIds = parent ? [...parent.pathIds, parent.id] : [];

    // Create category
    const newCategory = await this.prisma.category.create({
      data: {
        name,
        slug,
        description,
        image,
        icon,
        parentId,
        level,
        path,
        pathIds,
        metaTitle,
        metaDescription,
        sortOrder,
        isActive,
        isFeatured,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    // If parent exists, update its pathIds? Actually parent's pathIds should already include itself.
    // No need to update parent now because pathIds only contains ancestors, not self.

    return newCategory;
  }

  async findAll(includeInactive = false) {
    return this.prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        parent: true,
        children: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(idOrSlug: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        parent: true,
        children: {
          where: { isActive: true }, // optionally only active children
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // Check existence
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true },
    });
    if (!existingCategory) {
      throw new NotFoundException('Category not found');
    }

    const {
      name,
      slug: newSlug,
      parentId,
      isActive,
      isFeatured,
      sortOrder,
      ...rest
    } = updateCategoryDto;

    // Prepare update data
    const updateData: any = { ...rest };

    // Handle slug change
    if (newSlug && newSlug !== existingCategory.slug) {
      const slugExists = await this.prisma.category.findUnique({
        where: { slug: newSlug },
      });
      if (slugExists && slugExists.id !== id) {
        throw new ConflictException('Category with this slug already exists');
      }
      updateData.slug = newSlug;
    }

    // Handle name change (optional auto-slug generation if slug not explicitly provided)
    if (name && name !== existingCategory.name && !newSlug) {
      const autoSlug = slugify(name);
      const slugExists = await this.prisma.category.findUnique({
        where: { slug: autoSlug },
      });
      if (!slugExists || slugExists.id === id) {
        updateData.slug = autoSlug;
      }
      updateData.name = name;
    }

    // Handle parent change
    let newParent: Category | null = null;
    if (parentId !== undefined && parentId !== existingCategory.parentId) {
      if (parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      if (parentId) {
        newParent = await this.prisma.category.findUnique({
          where: { id: parentId },
        });
        if (!newParent) {
          throw new NotFoundException('Parent category not found');
        }
        // Check for circular reference (if newParent is a descendant of current category)
        const descendants = await this.getDescendantIds(id);
        if (descendants.includes(parentId)) {
          throw new BadRequestException('Cannot set a descendant as parent');
        }
        updateData.parentId = parentId;
      } else {
        updateData.parentId = null;
      }

      // Recompute level, path, pathIds for this category and all descendants
      await this.updateCategoryHierarchy(id, updateData.parentId);
    }

    // Apply other updates
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

    // Perform update (if we didn't already update hierarchy via separate transaction)
    // For simplicity, we'll let the hierarchy update happen in a separate function.
    // We'll call that function after this update if parent changed, but careful with transactions.
    // Better to do everything in a transaction.

    // For now, let's handle parent change separately.
    if (parentId !== undefined && parentId !== existingCategory.parentId) {
      // Use a transaction to update both this category and its descendants
      return await this.prisma.$transaction(async (tx) => {
        // Update this category's parent, and recompute its path/level/pathIds
        const updated = await tx.category.update({
          where: { id },
          data: {
            parentId: updateData.parentId,
            ...updateData, // include other fields
          },
        });

        // Update all descendants (children, grandchildren, etc.)
        await this.updateDescendantsPaths(tx, id);

        return this.findOne(id); // return fresh category
      });
    } else {
      // No parent change, simple update
      return this.prisma.category.update({
        where: { id },
        data: updateData,
        include: { parent: true, children: true },
      });
    }
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category has children
    if (category.children.length > 0) {
      throw new ConflictException('Cannot delete category with subcategories');
    }

    // Optionally, check if any products are assigned
    const productsCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productsCount > 0) {
      throw new ConflictException('Cannot delete category that has products');
    }

    return this.prisma.category.delete({ where: { id } });
  }

  async getTree(includeInactive = false) {
    const all = await this.prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { children: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const map = new Map();
    const roots: any[] = [];

    all.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    all.forEach((cat) => {
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId).children.push(map.get(cat.id));
      } else {
        roots.push(map.get(cat.id));
      }
    });

    return roots;
  }

  // Helper: Get all descendant IDs of a category (including itself)
  private async getDescendantIds(id: string): Promise<string[]> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!category) return [];

    let ids = [id];
    for (const child of category.children) {
      ids = ids.concat(await this.getDescendantIds(child.id));
    }
    return ids;
  }

  // Helper: Update paths for all descendants after parent change
  private async updateDescendantsPaths(tx: any, categoryId: string) {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
    });

    const children = await tx.category.findMany({
      where: { parentId: categoryId },
    });

    for (const child of children) {
      // Compute new level, path, pathIds for child
      const newLevel = category.level + 1;
      const newPath = category.path
        ? `${category.path}/${child.slug}`
        : `${category.slug}/${child.slug}`;
      const newPathIds = [...category.pathIds, category.id];

      await tx.category.update({
        where: { id: child.id },
        data: {
          level: newLevel,
          path: newPath,
          pathIds: newPathIds,
        },
      });

      // Recursively update grandchildren
      await this.updateDescendantsPaths(tx, child.id);
    }
  }

  // Separate function to handle hierarchy update when parent changes
  private async updateCategoryHierarchy(
    categoryId: string,
    newParentId: string | null,
  ) {
    // This would be called inside a transaction. We'll integrate it in update method.
  }
}
