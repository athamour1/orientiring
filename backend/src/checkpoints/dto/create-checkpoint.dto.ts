import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateCheckpointDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  pointValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  bonusForFirst?: number;
}
