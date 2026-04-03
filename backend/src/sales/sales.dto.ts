import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
} from 'class-validator';

export class SaleItemDto {
  @IsString()
  productId: string;

  @IsString()
  unitName: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  price: number;

  @IsNumber()
  @IsOptional()
  discount?: number;
}

export class CreateSaleDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsNumber()
  amountPaid: number;

  @IsString()
  @IsOptional()
  cashier?: string;

  @IsString()
  @IsOptional()
  terminalId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  userName?: string;
}
