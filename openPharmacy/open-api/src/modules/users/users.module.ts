import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../../common/audit/audit.module';
import { MailerModule } from '../../common/mailer/mailer.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { UserMailerListener } from './listeners/user-mailer.listener';

@Module({
  imports: [JwtModule.register({}), AuditModule, MailerModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserMailerListener],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
