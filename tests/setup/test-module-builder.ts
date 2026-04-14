// `/**
//  * TEST MODULE BUILDER
//  * 
//  * PURPOSE: Simplifies creation of NestJS test modules
//  * 
//  * WHY NEEDED: NestJS testing requires a lot of boilerplate
//  * 
//  * WITHOUT this helper:
//  *   const module = await Test.createTestingModule({
//  *     imports: [ConfigModule, LoggerModule, DatabaseModule],
//  *     providers: [UserService, PrismaService],
//  *   })
//  *   .overrideProvider(PrismaService).useValue(mockPrisma)
//  *   .compile();
//  * 
//  * WITH this helper:
//  *   const { userService, prisma } = await buildTestModule({
//  *     providers: [UserService],
//  *     mocks: [{ provide: PrismaService, value: mockPrisma }],
//  *   }).compile();
//  */

// import { Test, TestingModule } from '@nestjs/testing';
// import { Type } from '@nestjs/common';

// interface MockProvider {
//   provide: any;
//   value: any;
// }

// interface BuildTestModuleOptions {
//   /** Providers to include in the test module */
//   providers?: any[];
  
//   /** Controllers to include */
//   controllers?: any[];
  
//   /** Imports (other modules) */
//   imports?: any[];
  
//   /** Mocks to override real providers */
//   mocks?: MockProvider[];
// }

// /**
//  * Build a NestJS test module with minimal boilerplate
//  * 
//  * @example
//  * // Simple service test
//  * const { service } = await buildTestModule({
//  *   providers: [UserService],
//  *   mocks: [{ provide: PrismaService, value: mockPrisma }],
//  * });
//  * 
//  * @example
//  * // Controller test with dependencies
//  * const { controller, module } = await buildTestModule({
//  *   controllers: [UserController],
//  *   providers: [UserService],
//  *   imports: [ConfigModule],
//  *   mocks: [
//  *     { provide: UserService, value: mockUserService },
//  *     { provide: PrismaService, value: mockPrisma },
//  *   ],
//  * });
//  */
// export async function buildTestModule(options: BuildTestModuleOptions) {
//   const { providers = [], controllers = [], imports = [], mocks = [] } = options;
  
//   // Create test module builder
//   let moduleBuilder = Test.createTestingModule({
//     imports,
//     controllers,
//     providers,
//   });
  
//   // Apply all mocks
//   for (const mock of mocks) {
//     moduleBuilder = moduleBuilder.overrideProvider(mock.provide).useValue(mock.value);
//   }
  
//   // Compile the module
//   const module = await moduleBuilder.compile();
  
//   // Helper to get any provider by type
//   const get = <T>(type: Type<T>): T => module.get(type);
  
//   return {
//     module,
//     get,
//   };
// }

// /**
//  * Create a deep mock of a service
//  * 
//  * @example
//  * const mockUserService = createMock<UserService>({
//  *   findById: jest.fn().mockResolvedValue(mockUser),
//  *   create: jest.fn().mockResolvedValue(newUser),
//  * });
//  */
// export function createMock<T>(methods: Partial<Record<keyof T, jest.Mock>>): T {
//   return methods as T;
// }`