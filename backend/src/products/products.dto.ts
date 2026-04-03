import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductUnitDto {
  @IsString()
  unitName: string;

  @IsNumber()
  conversionFactor: number;

  @IsNumber()
  price: number;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsNumber()
  basePrice: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductUnitDto)
  units: ProductUnitDto[];

  @IsOptional()
  @IsNumber()
  lowStock?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  basePrice?: number;
}
