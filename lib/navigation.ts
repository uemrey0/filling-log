type RouterLike = {
  back: () => void
  push: (href: string) => void
}

export function navigateBack(router: RouterLike, fallbackHref: string) {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    return
  }

  router.push(fallbackHref)
}
