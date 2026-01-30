// Chat modal store removed during FAB revert. Provide a safe no-op export.
// Chat modal store removed during FAB revert. Provide a safe no-op export.
export const useChatModal = () => ({ open: false, setOpen: (_: boolean) => {}, toggle: () => {} });
