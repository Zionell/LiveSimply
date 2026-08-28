import { Controller, Get } from "@nestjs/common";
import { MockService } from "./mock.service";

@Controller("mock")
export class MockController {
	constructor(private readonly mockService: MockService) {}

	@Get()
	findAll() {
		return this.mockService.findAll();
	}
}
