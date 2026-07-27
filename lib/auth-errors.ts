/**
 * Firebase Authentication Error Code Mapper
 * Converts raw Firebase auth codes into human-friendly error messages.
 */
export function mapAuthError(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = typeof error === 'string' ? error : error?.code || '';
  const message = error?.message || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/network-request-failed':
      return 'Internet connection lost. Please check your network and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email address using another sign-in method.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is currently disabled.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/requires-recent-login':
      return 'Please sign in again to perform this sensitive action.';
    default:
      if (message.includes('network') || message.includes('offline')) {
        return 'Please check your internet connection and try again.';
      }
      return message || 'Authentication failed. Please try again.';
  }
}
