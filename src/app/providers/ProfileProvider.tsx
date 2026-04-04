import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDefaultProfile, type ProfileSettings } from "@/lib/api";
import { QK } from "@/lib/queryKeys";

type ProfileContextValue = {
  profileId: string;
  profile: ProfileSettings | undefined;
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
};

const ProfileContext = createContext<ProfileContextValue>({
  profileId: "",
  profile: undefined,
  isLoading: true,
  error: null,
  isReady: false,
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: QK.defaultProfile(),
    queryFn: getDefaultProfile,
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <ProfileContext.Provider
      value={{
        profileId: profile?.id ?? "",
        profile,
        isLoading,
        error: error ? String(error) : null,
        isReady: !!profile?.id && !isLoading,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
