import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPhone, instagramUrl, phoneUrl, shortLink, whatsappUrl } from '@/lib/contact';
import { fetchListingContact } from '@/lib/listings';
import type { ListingContact } from '@/types/listing';

type State =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'shown'; contact: ListingContact | null }
  | { status: 'error'; limit: boolean };

/**
 * The owner's contact outside the app. Hidden until "Show contact" is tapped, so the details
 * are only fetched by people who really want them (and bots can't collect them in bulk).
 */
export function ListingContactCard({ listingId }: { listingId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'hidden' });

  async function reveal() {
    setState({ status: 'loading' });
    try {
      setState({ status: 'shown', contact: await fetchListingContact(listingId) });
    } catch (error) {
      const limit =
        !!error &&
        typeof error === 'object' &&
        'message' in error &&
        String(error.message).includes('contact_limit');
      setState({ status: 'error', limit });
    }
  }

  const contact = state.status === 'shown' ? state.contact : null;

  return (
    <View
      style={[
        styles.card,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}>
      <ThemedText style={styles.title}>{t('listings.detail.contact')}</ThemedText>
      {state.status === 'hidden' || state.status === 'loading' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('listings.detail.contactIntro')}
          </ThemedText>
          {state.status === 'loading' ? (
            <ActivityIndicator color={theme.primary} style={styles.loading} />
          ) : (
            <Button label={t('listings.detail.showContact')} variant="secondary" onPress={reveal} />
          )}
        </>
      ) : state.status === 'error' ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {state.limit ? t('listings.detail.contactLimit') : t('listings.detail.contactError')}
        </ThemedText>
      ) : !contact ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('listings.detail.contactGone')}
        </ThemedText>
      ) : (
        <View style={styles.rows}>
          {contact.phone && (
            <View style={styles.phoneRow}>
              <ContactRow
                icon="phone"
                label={t('listings.form.phone')}
                value={formatPhone(contact.phone)}
                url={phoneUrl(contact.phone)}
              />
              {contact.phone_whatsapp && (
                <ContactRow
                  icon="message"
                  label={t('listings.detail.whatsapp')}
                  value={formatPhone(contact.phone)}
                  url={whatsappUrl(contact.phone)}
                />
              )}
            </View>
          )}
          {contact.instagram && (
            <ContactRow
              icon="at-sign"
              label={t('listings.form.instagram')}
              value={`@${contact.instagram}`}
              url={instagramUrl(contact.instagram)}
            />
          )}
          {contact.linkedin && (
            <ContactRow
              icon="briefcase"
              label={t('listings.form.linkedin')}
              value={shortLink(contact.linkedin)}
              url={contact.linkedin}
            />
          )}
          {contact.other_link && (
            <ContactRow
              icon="link"
              label={t('listings.detail.otherLink')}
              value={shortLink(contact.other_link)}
              url={contact.other_link}
            />
          )}
        </View>
      )}
      <View style={styles.safety}>
        <Icon name="shield" size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {t('listings.detail.contactSafety')}
        </ThemedText>
      </View>
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  url,
}: {
  icon: IconName;
  label: string;
  value: string;
  url: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => {
        Linking.openURL(url).catch(() => {});
      }}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name={icon} size={18} color={theme.primary} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={styles.value} numberOfLines={1}>
          {value}
        </ThemedText>
      </View>
      <Icon name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  loading: {
    paddingVertical: Spacing.two,
  },
  rows: {
    gap: Spacing.two,
  },
  phoneRow: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
    paddingRight: Spacing.three,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: 600,
  },
  safety: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
    marginTop: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
