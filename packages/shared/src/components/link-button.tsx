import { createLink } from '@tanstack/react-router'
import type { ComponentPropsWithRef } from 'react'
import { Button, type ButtonProps } from '@leitware/composables'

type AnchorButtonProps = ComponentPropsWithRef<'a'> & Pick<ButtonProps, 'variant' | 'size'>

export function AnchorButton({ children, variant, size, ...anchor }: AnchorButtonProps) {
	return (
		<Button variant={variant} size={size} render={<a {...anchor} role="link" />}>
			{children}
		</Button>
	)
}

// createLink preserves the consuming app's registered routes, search parameters and refs.
export const LinkButton = createLink(AnchorButton)
