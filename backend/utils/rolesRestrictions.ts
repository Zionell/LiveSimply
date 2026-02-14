import { ERole } from "@/types/user";

class RoleRestrictions {
	private readonly role: string;

	constructor(role: ERole) {
		this.role = role;
	}

	public getCurrencyCount(): number {
		switch (this.role) {
			case ERole.LVL3:
				return 30;
			case ERole.LVL2:
				return 50;
			default:
				return 170;
		}
	}

	public getBusinessCardLinkCount(): number {
		switch (this.role) {
			case ERole.LVL3:
				return 3;
			case ERole.LVL2:
				return 6;
			default:
				return 15;
		}
	}
}

export const roleRestrictions = (role: ERole = ERole.LVL3) =>
	new RoleRestrictions(role);
