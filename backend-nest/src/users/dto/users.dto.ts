import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SUPPORTED_COUNTRIES } from '../../lib/countries';
import { IsOurUploadUrl } from '../validators/is-our-upload-url.validator';
import { MEDIA_URL_OPTS } from '../../shared/lib/media-url';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class ConnectionsQueryDto {
  @IsOptional()
  @IsEnum(['followers', 'following'])
  type: 'followers' | 'following' = 'followers';
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  arabicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  bio?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  username?: string;

  @IsOptional()
  @IsUrl(MEDIA_URL_OPTS)
  @IsOurUploadUrl()
  avatar?: string;

  @IsOptional()
  @IsUrl(MEDIA_URL_OPTS)
  @IsOurUploadUrl()
  coverImage?: string;

  @IsOptional()
  @IsEnum(SUPPORTED_COUNTRIES)
  country?: (typeof SUPPORTED_COUNTRIES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  fcmToken?: string | null;
}

export class RateUserDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

export class SetFollowDto {
  @IsBoolean()
  following: boolean;
}
