import Cookies from 'js-cookie';

export const setToken = (token: string) => {
  const isSecure =
    typeof window !== "undefined"
      ? window.location.protocol === "https:"
      : process.env.NODE_ENV === "production";
  Cookies.set("token", token, {
    expires: 7,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
  });
};

export const getToken = (): string | undefined => {
  return Cookies.get('token');
};

export const removeToken = () => {
  Cookies.remove('token');
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};




