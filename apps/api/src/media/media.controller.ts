import {
  Body,
  Controller,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { CurrentUser, Roles, type AuthUser } from '../common/decorators';

/** Newsroom media uploads (image processing runs on the API for v1). */
@Controller('newsroom/media')
export class MediaController {
  constructor(private media: MediaService) {}

  @Post()
  @Roles('JOURNALIST', 'COPY_EDITOR', 'EDITOR')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body() body: { alt?: string; caption?: string; credit?: string; countryId?: string },
  ) {
    return this.media.uploadImage(user, file, body);
  }
}
