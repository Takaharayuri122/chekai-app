-- Login com código fixo para a conta de revisão das lojas (App Store / Play).
-- Só funciona para o usuário com a flag ligada E com LOGIN_FIXO_CODIGO (6 dígitos) definido na API.
-- Ligar:    UPDATE public.usuarios SET login_fixo_habilitado = true  WHERE email = '<email da revisão>';
-- Desligar: UPDATE public.usuarios SET login_fixo_habilitado = false WHERE email = '<email da revisão>';
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS login_fixo_habilitado boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
