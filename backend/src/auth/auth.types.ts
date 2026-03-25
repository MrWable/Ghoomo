import { UserRole } from '@ghoomo/db';

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  guideProfileId: string | null;
};
