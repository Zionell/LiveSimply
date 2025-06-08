import { Role } from "@prisma/client";

class RoleRestrictions {
	private readonly role: string;

	constructor(role: Role) {
		this.role = role;
	}

	public getCurrencyCount(): number {
		switch (this.role) {
			case Role.LVL3:
				return 30;
			case Role.LVL2:
				return 50;
			default:
				return 170;
		}
	}

	public getBusinessCardLinkCount(): number {
		switch (this.role) {
			case Role.LVL3:
				return 3;
			case Role.LVL2:
				return 6;
			default:
				return 15;
		}
	}
}

export const roleRestrictions = (role: Role = Role.LVL3) =>
	new RoleRestrictions(role);
