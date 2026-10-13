import * as React from "react"

const FALLBACK_IMAGE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3Cpath d='M70 300l90-100 65 70 50-55 55 85' fill='none' stroke='%239ca3af' stroke-width='18'/%3E%3Ccircle cx='165' cy='130' r='28' fill='%239ca3af'/%3E%3C/svg%3E"

const Image = React.forwardRef(({ src, onError, ...props }, ref) => {
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => setFailed(false), [src])

  return (
    <img
      ref={ref}
      src={failed || !src ? FALLBACK_IMAGE_URL : src}
      onError={(event) => {
        if (!failed && src) setFailed(true)
        else onError?.(event)
      }}
      {...props}
      data-empty-image={!src || undefined}
      data-error-image={failed || undefined}
    />
  )
})

Image.displayName = "Image"

export { Image }
