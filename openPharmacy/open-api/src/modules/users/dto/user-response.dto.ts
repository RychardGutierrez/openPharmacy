import { Expose } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  fullName!: string;

  @Expose()
  ci!: string;

  @Expose()
  email!: string;

  @Expose()
  role!: UserRole;

  @Expose()
  regNumber?: string | null;

  @Expose()
  active!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  deletedAt?: Date | null;
}
