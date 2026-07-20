import { UserResponseDto } from './user-response.dto';

export interface LoginServiceResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserResponseDto;
}

export class LoginResponseDto {
  accessToken!: string;
  expiresIn!: number;
  user!: UserResponseDto;
}
