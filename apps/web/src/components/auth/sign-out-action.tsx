import { useClerk } from "@clerk/tanstack-react-start";
import { useState, type ComponentProps } from "react";
import { clearActiveOrganizationFn } from "@/server/access";

export type SignOutActionProps = Omit<
	ComponentProps<"button">,
	"children" | "onClick"
> & {
	children: React.ReactNode;
	redirectUrl?: string;
};

function clearDemoCookies() {
	document.cookie = "dev_session=; Max-Age=0; Path=/; SameSite=Lax";
	document.cookie = "ikpa_active_org=; Max-Age=0; Path=/; SameSite=Lax";
}

function DemoSignOutAction({
	children,
	redirectUrl = "/",
	...props
}: SignOutActionProps) {
	return (
		<button
			{...props}
			onClick={() => {
				clearDemoCookies();
				window.location.assign(redirectUrl);
			}}
			type="button"
		>
			{children}
		</button>
	);
}

function ClerkSignOutAction({
	children,
	redirectUrl = "/",
	...props
}: SignOutActionProps) {
	const { signOut } = useClerk();
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
				await signOut({ redirectUrl });
			} finally {
				setIsBusy(false);
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

export function SignOutAction(props: SignOutActionProps) {
	if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()) {
		return <ClerkSignOutAction {...props} />;
	}

	return <DemoSignOutAction {...props} />;
}
