import { type ComponentProps, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { clearActiveOrganizationFn } from "@/server/access";

export type SignOutActionProps = Omit<
	ComponentProps<"button">,
	"children" | "onClick"
> & {
	children: React.ReactNode;
	redirectUrl?: string;
};

export function SignOutAction({
	children,
	redirectUrl = "/",
	...props
}: SignOutActionProps) {
	const [isBusy, setIsBusy] = useState(false);

	const handleSignOut = async () => {
		if (isBusy) {
			return;
		}

		setIsBusy(true);
		try {
			await clearActiveOrganizationFn({ data: undefined });
		} finally {
			try {
				await authClient.signOut();
			} finally {
				// Full reload so no authenticated UI state survives the session.
				window.location.assign(redirectUrl);
			}
		}
	};

	return (
		<button
			{...props}
			disabled={isBusy || props.disabled}
			onClick={() => void handleSignOut()}
			type="button"
		>
			{children}
		</button>
	);
}
