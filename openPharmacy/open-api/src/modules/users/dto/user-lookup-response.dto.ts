import { Expose } from 'class-transformer';

export class UserLookupResponseDto {
  @Expose()
  id!: string;

  @Expose()
  fullName!: string;

  @Expose()
  email!: string;
}
