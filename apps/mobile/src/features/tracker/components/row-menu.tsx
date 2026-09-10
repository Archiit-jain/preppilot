import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Sheet, Text } from '../../../components/ui';
import { useTheme } from '../../../theme/theme-context';

export interface RowMenuAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

export interface RowMenuProps {
  readonly actions: readonly RowMenuAction[];
  /** What the menu acts on, e.g. "Mathematics" — the trigger has no visible label. */
  readonly label: string;
}

/**
 * The per-row overflow menu.
 *
 * The visible three-dot icon remains compact, while the trigger itself has
 * a comfortable mobile touch target.
 */
export function RowMenu({ actions, label }: RowMenuProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const run = (action: RowMenuAction) => {
    setOpen(false);
    action.onPress();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Options for ${label}`}
        accessibilityHint="Opens actions for this item"
        hitSlop={12}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            minWidth: theme.minTouchTarget,
            minHeight: theme.minTouchTarget,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Text variant="body" tone="muted" weight="bold">
          ⋮
        </Text>
      </Pressable>

      <Sheet visible={open} onDismiss={() => setOpen(false)} label={`Options for ${label}`}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>

        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => run(action)}
            style={({ pressed }) => [
              styles.action,
              {
                minHeight: theme.minTouchTarget,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.md,
                backgroundColor: pressed ? theme.colors.surfaceElevated : 'transparent',
              },
            ]}
          >
            <Text variant="body" tone={action.destructive === true ? 'danger' : 'primary'}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  action: {
    justifyContent: 'center',
  },
});
