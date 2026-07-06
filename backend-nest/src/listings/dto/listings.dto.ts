import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SUPPORTED_COUNTRIES } from '../../lib/countries';

const LISTING_CATEGORIES = [
  'camels',
  'sheep',
  'goats',
  'cows',
  'horses',
  'birds',
  'feed',
  'equipment',
] as const;

export class ListListingsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsEnum(LISTING_CATEGORIES)
  category?: (typeof LISTING_CATEGORIES)[number];

  @IsOptional()
  @IsEnum(SUPPORTED_COUNTRIES)
  country?: (typeof SUPPORTED_COUNTRIES)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;
}

export class CreateListingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  arabicTitle!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  arabicDescription!: string;

  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsEnum(LISTING_CATEGORIES)
  category!: (typeof LISTING_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  breed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  age?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  @Type(() => Number)
  quantity?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  arabicLocation!: string;

  @IsEnum(SUPPORTED_COUNTRIES)
  country!: (typeof SUPPORTED_COUNTRIES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUrl({}, { each: true })
  images!: string[];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  arabicTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  arabicDescription?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  breed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  age?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  arabicLocation?: string;
}
