import { PartialType } from "@nestjs/swagger";
import { CreateGoalsDto } from "./create-goals.dto";

export class UpdateGoalsDto extends PartialType(CreateGoalsDto) {}
