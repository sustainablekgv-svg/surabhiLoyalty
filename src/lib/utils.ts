import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import bcrypt from 'bcryptjs';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const hashPin = async (pin: string): Promise<string> => {
  return await bcrypt.hash(pin, 10);
};

export const verifyPin = async (pin: string, hashedPin: string): Promise<boolean> => {
  return await bcrypt.compare(pin, hashedPin);
};