import Cookies from 'js-cookie';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const auth = {
  setToken: (token: string) => {
    Cookies.set(TOKEN_KEY, token, { expires: 1 }); // 1 day
  },
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return Cookies.get(TOKEN_KEY) || null;
  },
  setUser: (user: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
  getUser: () => {
    if (typeof window === 'undefined') return null;
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  logout: () => {
    Cookies.remove(TOKEN_KEY);
    if (typeof window !== 'undefined') localStorage.removeItem(USER_KEY);
  },
  isLoggedIn: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!Cookies.get(TOKEN_KEY);
  },
};
