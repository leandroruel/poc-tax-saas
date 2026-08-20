import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import {
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      roles: {
        owner: ownerAc,
        admin: adminAc,
        operator: memberAc,
        reviewer: memberAc,
      },
    }),
  ],
});
