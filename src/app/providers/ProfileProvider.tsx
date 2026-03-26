import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDefaultProfile, type ProfileSettings } from "@/lib/api";
import { QK } from "@/lib/queryKeys";

type ProfileContextValue = {
  profileId: string;
  profile: ProfileSettings | undefined;
  isLoading: boolean;
};

const ProfileContext = createContext<ProfileContextValue>({
  profileId: "default",
  profile: undefined,
  isLoading: true,
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: QK.defaultProfile(),
    queryFn: getDefaultProfile,
    staleTime: 60_000,
  });

  return (
    <ProfileContext.Provider
      value={{
        profileId: profile?.id ?? "default",
        profile,
        isLoading,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
