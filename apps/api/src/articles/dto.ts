import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ARTICLE_STATUSES,
  ARTICLE_TYPES,
  LOCALES,
  type ArticleStatus,
  type ArticleType,
  type Locale,
} from '@pressly/types';

export class CreateArticleDto {
  @IsString()
  @MaxLength(300)
  workingTitle!: string;

  @IsOptional()
  @IsIn(ARTICLE_TYPES)
  articleType?: ArticleType;

  @IsOptional()
  @IsIn(LOCALES)
  primaryLanguage?: Locale;
}

export class UpdateArticleDto {
  @IsOptional() @IsString() @MaxLength(300) headline?: string;
  @IsOptional() @IsString() @MaxLength(300) subheadline?: string;
  @IsOptional() @IsString() @MaxLength(300) workingTitle?: string;
  @IsOptional() @IsString() @MaxLength(600) summary?: string;

  /** The structured Tiptap document. */
  @IsOptional() @IsObject() bodyJson?: Record<string, unknown>;

  @IsOptional() @IsIn(ARTICLE_TYPES) articleType?: ArticleType;
  @IsOptional() @IsIn(LOCALES) primaryLanguage?: Locale;

  @IsOptional() @IsString() countryId?: string;
  @IsOptional() @IsString() topicId?: string;
  @IsOptional() @IsString() heroImageId?: string;

  @IsOptional() @IsBoolean() isBreaking?: boolean;
  @IsOptional() @IsInt() homepagePlacement?: number;

  @IsOptional() @IsString() @MaxLength(300) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(400) metaDescription?: string;
  @IsOptional() @IsString() @MaxLength(300) socialHeadline?: string;
  @IsOptional() @IsString() @MaxLength(400) socialDescription?: string;

  /** ISO datetime for scheduled publication. */
  @IsOptional() @IsString() publishAt?: string;
}

export class TransitionDto {
  @IsIn(ARTICLE_STATUSES)
  toStatus!: ArticleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
