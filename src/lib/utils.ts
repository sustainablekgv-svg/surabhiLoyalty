import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { SHA256 } from 'crypto-js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const hashPin = (pin: string): string => {
  return SHA256(pin).toString();
};

export const verifyPin = (pin: string, hashedPin: string): boolean => {
  return SHA256(pin).toString() === hashedPin;
};