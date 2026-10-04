import { Text } from '../../../components/ui';

export interface WelcomeCardProps {
  readonly name: string;
}

/**
 * The greeting at the top of the tracker.
 *
 * There used to be a "Continue tracking" card under it; the project owner found
 * it intrusive and it was removed (D110). Each subject's play button already
 * starts its timer in one tap.
 */
export function WelcomeCard({ name }: WelcomeCardProps) {
  return (
    <Text variant="heading" numberOfLines={2} testID="welcome-greeting">
      Welcome, {name}
    </Text>
  );
}
