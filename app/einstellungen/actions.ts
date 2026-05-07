'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function passwortAendern(formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (newPassword !== confirmPassword) {
    redirect('/einstellungen?error=mismatch');
  }

  if (newPassword.length < 8) {
    redirect('/einstellungen?error=short');
  }

  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect('/einstellungen?error=auth');
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    redirect('/einstellungen?error=wrong');
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    redirect('/einstellungen?error=update');
  }

  redirect('/einstellungen?success=1');
}
