import { IsString, IsBoolean, IsOptional, MaxLength, IsDateString, IsIn, IsInt, IsNumber, Min, Max } from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  showTeamLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  showDirectionArrow?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['en-US', 'el'])
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  firstFinishBonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90) @Max(90)
  startLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180) @Max(180)
  startLng?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90) @Max(90)
  returnLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180) @Max(180)
  returnLng?: number;

  @IsOptional()
  @IsBoolean()
  returnSameAsStart?: boolean;
}
