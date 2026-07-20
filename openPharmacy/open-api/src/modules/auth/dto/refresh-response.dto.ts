import { UserResponseDto } from './user-response.dto';

export interface RefreshServiceResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserResponseDto;
}

export class RefreshResponseDto {
  accessToken!: string;
  expiresIn!: number;
  user!: UserResponseDto;
}
