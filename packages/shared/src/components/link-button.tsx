import { createLink } from '@tanstack/react-router'
import type { ComponentPropsWithRef } from 'react'
import { Button, type ButtonProps } from '@leitware/composables'

type AnchorButtonProps = ComponentPropsWithRef<'a'> &
	Pick<ButtonProps, 'variant' | 'size' | 'shape'>

/** One adapter for Composables' anchor semantics and its missing nativeButton prop type. */
export function AnchorButton({ children, variant, size, shape, ...anchor }: AnchorButtonProps) {
	return (
		<Button
			variant={variant}
			size={size}
			shape={shape}
			{...{ nativeButton: false }}
			render={<a {...anchor} role="link" />}
		>
			{children}
		</Button>
	)
}

// createLink preserves the consuming app's registered routes, search parameters and refs.
export const LinkButton = createLink(AnchorButton)
