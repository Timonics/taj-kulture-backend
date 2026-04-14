import { Cart, CartItem } from 'generated/prisma/client';

export interface ICart extends Cart {
    items: CartItem[] 
}
