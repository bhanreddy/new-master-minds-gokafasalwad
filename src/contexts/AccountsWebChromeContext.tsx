import React, { createContext, useContext } from 'react';

export type AccountsWebChromeContextValue = {
  /** When true, layout renders persistent header + sidebar; screens should omit AdminHeader / menu overlay. */
  shellActive: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
};

const AccountsWebChromeContext = createContext<AccountsWebChromeContextValue>({
  shellActive: false,
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
});

export function AccountsWebChromeProvider({
  value,
  children,
}: {
  value: AccountsWebChromeContextValue;
  children: React.ReactNode;
}) {
  return (
    <AccountsWebChromeContext.Provider value={value}>
      {children}
    </AccountsWebChromeContext.Provider>
  );
}

export function useAccountsWebChrome() {
  return useContext(AccountsWebChromeContext);
}
