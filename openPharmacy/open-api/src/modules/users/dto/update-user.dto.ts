import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * All fields editable, but validation decorators are inherited from
 * CreateUserDto. Role changes are intentionally not allowed here; a dedicated
 * endpoint should be used if role elevation is required.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
