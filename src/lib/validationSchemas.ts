import { z } from "zod";

export const emailSchema = z.string().trim().email("Email inválido").max(255, "Email muito longo");

// Blacklist de senhas fracas (sincronizada com backend)
const WEAK_PASSWORDS = new Set(['123456', '12345678', 'password', 'senha123', 'admin123', 'qwerty']);

export const passwordSchema = z.string()
  .min(6, "Senha deve ter no mínimo 6 caracteres")
  .max(128, "Senha deve ter no máximo 128 caracteres")
  .refine(
    (pwd) => !WEAK_PASSWORDS.has(pwd.toLowerCase()),
    { message: "Senha muito fraca. Evite senhas comuns como '123456', 'password' ou 'senha123'. Use uma combinação de letras, números e caracteres especiais." }
  );

export const nomeSchema = z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome muito longo");
