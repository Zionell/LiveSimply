import { Injectable } from "@nestjs/common";

@Injectable()
export class MockService {
	async findAll() {
		const url =
			"https://edamam-food-and-grocery-database.p.rapidapi.com/api/food-database/v2/parser?nutrients=%5Bobject+Object%5D&nutrition-type=cooking&category=%5B%0A++%22generic-foods%22%0A%5D";

		const options = {
			method: "GET",
			headers: {
				"x-rapidapi-key":
					"34d7ebc2e2msh894c648ffe44d0ep16502fjsnfd161433cf8c",
				"x-rapidapi-host": "food-calorie-api.p.rapidapi.com",
				"Content-Type": "application/json",
			},
		};

		try {
			const response = await fetch(url, options);
			const result = await response.text();

			return result;
		} catch (error) {
			console.error(error);
		}

		return `This action returns all mock`;
	}
}
