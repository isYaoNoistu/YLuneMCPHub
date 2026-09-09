export const copyToClipboard = async (value: string): Promise<boolean> => {
  if (!value) {
    return false;
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // HTTP on a public IP is not a secure context; fall through.
  }

  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '2px';
    el.style.height = '2px';
    el.style.padding = '0';
    el.style.border = 'none';
    el.style.outline = 'none';
    el.style.boxShadow = 'none';
    el.style.background = 'transparent';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};
