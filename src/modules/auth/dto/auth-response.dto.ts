import { TokenResponseDto } from './refresh-token.dto';
import { UserResponseDto } from 'src/modules/users/dto';

export class AuthResponseDto {
  user: Partial<UserResponseDto>;
  tokens: TokenResponseDto;
}
