import { Prisma } from "@prisma/client";

export function normalizeError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2002":
        return "This record already exists";
      case "P2025":
        return "Record not found";
      case "P2003":
        return "Related record not found";
      case "P2014":
        return "This change would violate a required relation";
      default:
        return "Database error";
    }
  }
  if (e instanceof Error) return e.message;
  return "An unexpected error occurred";
}
