import React, { useState, useMemo, useRef, useEffect } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Animated, Pressable, Platform, Share, ActivityIndicator
} from 'react-native';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import { FeeService as FeesService } from '../../../src/services/feeService';
import { UpiSettingsService } from '../../../src/services/upiSettingsService';
import { APIError } from '../../../src/services/apiClient';
import { useTheme } from '../../../src/hooks/useTheme';
import { generateReceiptPDF } from '../../../src/utils/pdfGenerator';
import { showConfirm, showSuccess, showError } from '../../../src/components/CustomAlert';
import { buildUpiPayUri, parseInrAmount } from '../../../src/utils/upiDeepLink';
import LogoLoader from '../../../src/components/LogoLoader';

export const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const PAYMENT_MODES = [
    { id: 'Cash', label: 'Cash', icon: '💵' },
    { id: 'UPI', label: 'UPI', icon: '📲' },
    { id: 'Cheque', label: 'Cheque', icon: '🏦' },
];

// ─── Animated Mode Button ────────────────────────────────────────────────────
function ModeButton({
    item, selected, onPress, theme, isDark
}: {
    item: typeof PAYMENT_MODES[0];
    selected: boolean;
    onPress: () => void;
    theme: any;
    isDark: boolean;
}) {
    const scale = useRef(new Animated.Value(1)).current;
    const bg = useRef(new Animated.Value(selected ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(bg, {
            toValue: selected ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [selected]);

    const handlePressIn = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
    const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    const backgroundColor = bg.interpolate({
        inputRange: [0, 1],
        outputRange: [
            isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFF',
            isDark ? 'rgba(59,130,246,0.18)' : '#DBEAFE',
        ],
    });
    const borderColor = bg.interpolate({
        inputRange: [0, 1],
        outputRange: [
            isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
            '#3B82F6',
        ],
    });

    return (
        <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
            <Animated.View style={[modeStyles.btn, { backgroundColor, borderColor }]}>
                <Pressable
                    style={modeStyles.inner}
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                >
                    <Text style={modeStyles.icon}>{item.icon}</Text>
                    <Text style={[
                        modeStyles.label,
                        { color: selected ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.5)' : '#6B7280') }
                    ]}>
                        {item.label}
                    </Text>
                    {selected && (
                        <View style={modeStyles.dot} />
                    )}
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

const modeStyles = StyleSheet.create({
    btn: {
        borderWidth: 1.5,
        borderRadius: 14,
        overflow: 'hidden',
    },
    inner: {
        paddingVertical: 14,
        alignItems: 'center',
        gap: 4,
    },
    icon: { fontSize: 20 },
    label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
    dot: {
        width: 5, height: 5, borderRadius: 3,
        backgroundColor: '#3B82F6', marginTop: 2,
    },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CollectFeesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const { shellActive } = useAccountsWebChrome();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState('Cash');
    const [remarks, setRemarks] = useState('');
    const [focused, setFocused] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [upiLoading, setUpiLoading] = useState(false);
    const [upiLoadError, setUpiLoadError] = useState<string | null>(null);
    const [schoolUpiId, setSchoolUpiId] = useState('');
    const [schoolPayeeName, setSchoolPayeeName] = useState('');

    const feeId = params.feeId as string;
    const studentName = params.name as string;
    const admissionNo = params.admissionNo as string;
    const feeType = params.feeType as string;
    const dueAmount = params.due as string;

    // Entry animations
    const cardAnim = useRef(new Animated.Value(0)).current;
    const formAnim = useRef(new Animated.Value(0)).current;
    const btnAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.stagger(80, [
            Animated.spring(cardAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
            Animated.spring(formAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
            Animated.spring(btnAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
        ]).start();
    }, []);

    const [upiFetchTick, setUpiFetchTick] = useState(0);

    useEffect(() => {
        if (mode !== 'UPI') return;
        let alive = true;
        setUpiLoading(true);
        setUpiLoadError(null);
        UpiSettingsService.get()
            .then((d) => {
                if (!alive) return;
                setSchoolUpiId((d.upi_id ?? '').trim());
                setSchoolPayeeName((d.display_name ?? '').trim());
            })
            .catch((e) => {
                if (!alive) return;
                setUpiLoadError(e instanceof APIError ? e.message : 'Could not load school UPI settings.');
            })
            .finally(() => {
                if (alive) setUpiLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [mode, upiFetchTick]);

    const dueNum = parseFloat(dueAmount) || 0;
    const amountNum = parseFloat(amount) || 0;
    const remaining = Math.max(0, dueNum - amountNum);
    const isOverpay = amountNum > dueNum && dueNum > 0;
    const isReady = amountNum > 0 && !isOverpay;
    const inrAmountStr = parseInrAmount(amount);
    const upiPayUri =
        mode === 'UPI' && inrAmountStr && schoolUpiId && schoolPayeeName
            ? buildUpiPayUri(schoolUpiId, schoolPayeeName, inrAmountStr, remarks)
            : '';
    const upiQrReady = mode === 'UPI' && isReady && !!upiPayUri && !upiLoading && !upiLoadError;

    const recordPayment = async () => {
        const result = await FeesService.collectFee({
            student_fee_id: feeId,
            amount: amountNum,
            payment_method: mode.toLowerCase() as 'cash' | 'upi' | 'cheque',
            transaction_ref: generateUUID(),
            remarks,
        });
        setPaymentError(null);
        if (Platform.OS === 'web') {
            await showSuccess(
                '✓ Payment Recorded',
                `Ref: ${result.transaction_ref || (result as any).id}\n\nLedger updated successfully.`,
                [
                    {
                        text: 'Print Receipt',
                        onPress: async () => {
                            await generateReceiptPDF({
                                ...result,
                                student_name: studentName,
                                admission_no: admissionNo,
                                fee_type: feeType,
                                academic_year: result.academic_year || (result as any).academicYear,
                                paid_at: new Date().toISOString(),
                            });
                        },
                    },
                    { text: 'Done' },
                ],
            );
            router.back();
            return;
        }
        alertCompat(
            '✓ Payment Recorded',
            `Ref: ${result.transaction_ref || (result as any).id}\n\nLedger updated successfully.`,
            [
                {
                    text: 'Print Receipt',
                    onPress: async () => {
                        await generateReceiptPDF({
                            ...result,
                            student_name: studentName,
                            admission_no: admissionNo,
                            fee_type: feeType,
                            academic_year: result.academic_year || (result as any).academicYear,
                            paid_at: new Date().toISOString(),
                        });
                        router.back();
                    },
                },
                { text: 'Done', onPress: () => router.back() },
            ],
        );
    };

    const handleCollect = async () => {
        setPaymentError(null);
        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            const m = 'Please enter a valid amount greater than zero.';
            setPaymentError(m);
            alertCompat('Invalid Amount', m);
            return;
        }
        if (!isNaN(dueNum) && amountNum > dueNum) {
            const m = `₹${amountNum} exceeds due amount ₹${dueNum}.`;
            setPaymentError(m);
            alertCompat('Overpayment', m);
            return;
        }
        if (amountNum > 1000000) {
            const m = 'Amount exceeds maximum limit of ₹10,00,000.';
            setPaymentError(m);
            alertCompat('Invalid Amount', m);
            return;
        }
        if (!feeId) {
            const m = 'Fee record identifier is missing. Go back and open Collect from the fee ledger again.';
            setPaymentError(m);
            alertCompat('Error', m);
            return;
        }

        if (mode === 'UPI') {
            if (upiLoading) {
                const m = 'Loading school UPI settings…';
                setPaymentError(m);
                return;
            }
            if (upiLoadError) {
                setPaymentError(upiLoadError);
                return;
            }
            if (!schoolUpiId || !schoolPayeeName) {
                const m =
                    'School UPI is not configured. Ask an admin to set UPI ID under Admin → UPI fee settings, or use Cash/Cheque.';
                setPaymentError(m);
                alertCompat('UPI not configured', m);
                return;
            }
            if (!inrAmountStr) {
                const m = 'Enter a valid amount for UPI (up to 2 decimal places).';
                setPaymentError(m);
                return;
            }
            if (!upiPayUri) {
                const m = 'Could not build UPI payment link. Check amount and school UPI settings.';
                setPaymentError(m);
                return;
            }
        }

        const confirmMsg =
            mode === 'UPI'
                ? `Record ₹${amountNum.toLocaleString('en-IN')} UPI payment to the ledger?\n\nOnly confirm after the payer has completed payment in their UPI app (you should have shown them the QR above).`
                : `Record ₹${amountNum.toLocaleString('en-IN')} via ${mode}?\n\nThis action is permanent and will be logged.`;

        const confirmed = await showConfirm({
            title: 'Confirm Payment',
            message: confirmMsg,
            confirmText: 'Confirm & Record',
            cancelText: 'Cancel',
            type: 'confirm',
        });
        if (!confirmed) return;
        setLoading(true);
        try {
            await recordPayment();
        } catch (error: any) {
            const msg =
                error?.message ||
                (Platform.OS === 'web'
                    ? 'Could not process payment. Check network and permissions (fees.collect).'
                    : 'Could not process payment. Check backend logs.');
            setPaymentError(msg);
            await showError('Payment Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {!shellActive && <AdminHeader title="Collect Fee" showBackButton={true} />}

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Student Info Card ── */}
                <Animated.View style={[
                    styles.infoCard,
                    {
                        opacity: cardAnim,
                        transform: [{
                            translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
                        }]
                    }
                ]}>
                    {/* Accent stripe */}
                    <View style={styles.cardAccent} />

                    <View style={styles.cardBody}>
                        {/* Avatar */}
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {(studentName || 'S').charAt(0).toUpperCase()}
                            </Text>
                        </View>

                        <View style={styles.cardInfo}>
                            <Text style={styles.studentName} numberOfLines={1}>
                                {studentName || 'Unknown Student'}
                            </Text>
                            <View style={styles.tagRow}>
                                <View style={styles.tag}>
                                    <Text style={styles.tagText}>#{admissionNo || '—'}</Text>
                                </View>
                                {feeType ? (
                                    <View style={[styles.tag, styles.tagBlue]}>
                                        <Text style={[styles.tagText, { color: '#3B82F6' }]}>
                                            {feeType}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </View>

                    <View style={styles.dueRow}>
                        <View style={styles.dueBlock}>
                            <Text style={styles.dueLabel}>TOTAL DUE</Text>
                            <Text style={styles.dueValue}>
                                ₹{parseFloat(dueAmount || '0').toLocaleString('en-IN')}
                            </Text>
                        </View>
                        <View style={styles.dueSep} />
                        <View style={styles.dueBlock}>
                            <Text style={styles.dueLabel}>AFTER PAYMENT</Text>
                            <Text style={[
                                styles.dueValue,
                                { color: isReady ? '#10B981' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') }
                            ]}>
                                ₹{isReady ? remaining.toLocaleString('en-IN') : '—'}
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* ── Payment Form ── */}
                <Animated.View style={[
                    styles.form,
                    {
                        opacity: formAnim,
                        transform: [{
                            translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
                        }]
                    }
                ]}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>

                    {/* Amount Input */}
                    <Text style={styles.inputLabel}>Amount</Text>
                    <View style={[
                        styles.amountBox,
                        focused && styles.amountBoxFocused,
                        isOverpay && styles.amountBoxError,
                    ]}>
                        <Text style={styles.rupeeSymbol}>₹</Text>
                        <AppTextInput
                            style={[ds.inputInChrome, styles.amountInput]}
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={(t) => {
                                setPaymentError(null);
                                setAmount(t);
                            }}
                            placeholder="0"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                        />
                        {isReady && (
                            <View style={styles.fullPayBadge}>
                                <Text style={styles.fullPayText}>
                                    {amountNum === dueNum ? 'FULL' : 'PARTIAL'}
                                </Text>
                            </View>
                        )}
                    </View>
                    {isOverpay && (
                        <Text style={styles.errorHint}>
                            ⚠ Exceeds due amount by ₹{(amountNum - dueNum).toLocaleString('en-IN')}
                        </Text>
                    )}

                    {/* Quick-fill chips */}
                    {dueNum > 0 && (
                        <View style={styles.chipRow}>
                            {[0.25, 0.5, 0.75, 1].map((ratio) => {
                                const val = Math.round(dueNum * ratio);
                                const label = ratio === 1 ? 'Full' : `${ratio * 100}%`;
                                return (
                                    <TouchableOpacity
                                        key={ratio}
                                        style={[
                                            styles.chip,
                                            amountNum === val && styles.chipActive,
                                        ]}
                                        onPress={() => {
                                            setPaymentError(null);
                                            setAmount(String(val));
                                        }}
                                    >
                                        <Text style={[
                                            styles.chipText,
                                            amountNum === val && styles.chipTextActive,
                                        ]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Payment Mode */}
                    <Text style={[styles.inputLabel, { marginTop: 4 }]}>Payment Mode</Text>
                    <View style={styles.modeRow}>
                        {PAYMENT_MODES.map((m) => (
                            <ModeButton
                                key={m.id}
                                item={m}
                                selected={mode === m.id}
                                onPress={() => {
                                    setPaymentError(null);
                                    setMode(m.id);
                                }}
                                theme={theme}
                                isDark={isDark}
                            />
                        ))}
                    </View>

                    {/* Remarks */}
                    <Text style={styles.inputLabel}>Remarks</Text>
                    <AppTextInput
                        style={styles.remarksInput}
                        multiline
                        value={remarks}
                        onChangeText={(t) => {
                            setPaymentError(null);
                            setRemarks(t);
                        }}
                        placeholder="e.g. Receipt no. 1234, partial for Q1…"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
                    />
                </Animated.View>

                {/* ── Summary + CTA ── */}
                <Animated.View style={[
                    {
                        opacity: btnAnim,
                        transform: [{
                            translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
                        }]
                    }
                ]}>
                    {isReady && (
                        <View style={styles.summaryCard}>
                            <SummaryRow label="Student" value={studentName || '—'} />
                            <SummaryRow label="Amount" value={`₹${amountNum.toLocaleString('en-IN')}`} highlight />
                            <SummaryRow label="Mode" value={mode} />
                            <SummaryRow label="Balance After" value={`₹${remaining.toLocaleString('en-IN')}`} />
                        </View>
                    )}

                    {mode === 'UPI' && isReady ? (
                        <View style={styles.upiQrSection}>
                            <Text style={styles.upiQrTitle}>Pay via UPI</Text>
                            <Text style={styles.upiQrSub}>
                                Show this QR to the payer. Amount and note update when you change the fields above.
                            </Text>
                            {upiLoading ? (
                                <View style={styles.upiQrCenter}>
                                    <ActivityIndicator color="#3B82F6" />
                                    <Text style={styles.upiQrMuted}>Loading school UPI…</Text>
                                </View>
                            ) : upiLoadError ? (
                                <View style={styles.upiQrWarn}>
                                    <Text style={styles.upiQrWarnText}>{upiLoadError}</Text>
                                    <TouchableOpacity onPress={() => setUpiFetchTick((n) => n + 1)} style={{ marginTop: 10 }}>
                                        <Text style={styles.upiQrLink}>Retry</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setMode('Cash')}>
                                        <Text style={[styles.upiQrLink, { marginTop: 6 }]}>Use Cash / Cheque instead</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : !schoolUpiId || !schoolPayeeName ? (
                                <View style={styles.upiQrWarn}>
                                    <Text style={styles.upiQrWarnText}>
                                        School UPI is not set. An admin must configure it under Admin → UPI fee settings.
                                    </Text>
                                </View>
                            ) : !inrAmountStr ? (
                                <Text style={styles.upiQrMuted}>Enter a valid amount to generate the QR.</Text>
                            ) : (
                                <>
                                    <View style={styles.upiQrFrame}>
                                        <QRCode value={upiPayUri} size={200} color="#0f172a" backgroundColor="#FFFFFF" />
                                    </View>
                                    <View style={styles.upiQrMeta}>
                                        <Text style={styles.upiQrMetaLine}>
                                            <Text style={styles.upiQrMetaLab}>UPI ID </Text>
                                            {schoolUpiId}
                                        </Text>
                                        <Text style={styles.upiQrMetaLine}>
                                            <Text style={styles.upiQrMetaLab}>Amount </Text>₹{inrAmountStr}
                                        </Text>
                                        {remarks.trim() ? (
                                            <Text style={styles.upiQrMetaLine} numberOfLines={2}>
                                                <Text style={styles.upiQrMetaLab}>Note </Text>
                                                {remarks.trim()}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <TouchableOpacity
                                        style={styles.upiShareBtn}
                                        onPress={() => Share.share({ message: upiPayUri, title: 'UPI payment' }).catch(() => { })}
                                    >
                                        <Text style={styles.upiShareBtnText}>Share UPI link</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.upiLedgerHint}>
                                        After payment appears in the school UPI account, tap the green button below to record it in the fee ledger.
                                    </Text>
                                </>
                            )}
                        </View>
                    ) : null}

                    {paymentError ? (
                        <View style={[styles.errorBanner, { borderColor: isDark ? 'rgba(248,113,113,0.5)' : '#FECACA', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2' }]}>
                            <Text style={[styles.errorBannerText, { color: isDark ? '#FECACA' : '#991B1B' }]}>{paymentError}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[
                            styles.payBtn,
                            (!isReady || loading || (mode === 'UPI' && !upiQrReady)) && styles.payBtnDisabled,
                        ]}
                        onPress={handleCollect}
                        disabled={!isReady || loading || (mode === 'UPI' && !upiQrReady)}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <LogoLoader color="#fff" />
                        ) : (
                            <View style={styles.payBtnInner}>
                                <Text style={styles.payBtnText}>
                                    {!isReady
                                        ? 'Enter Amount to Continue'
                                        : mode === 'UPI'
                                            ? `Record ₹${amountNum.toLocaleString('en-IN')} to ledger`
                                            : `Collect ₹${amountNum.toLocaleString('en-IN')}`}
                                </Text>
                                {isReady && (mode !== 'UPI' || upiQrReady) ? (
                                    <Text style={styles.payBtnArrow}>→</Text>
                                ) : null}
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

// ─── Summary Row Helper ───────────────────────────────────────────────────────
function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <View style={summaryStyles.row}>
            <Text style={summaryStyles.label}>{label}</Text>
            <Text style={[summaryStyles.value, highlight && summaryStyles.highlight]}>{value}</Text>
        </View>
    );
}
const summaryStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
    label: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
    value: { fontSize: 13, color: '#374151', fontWeight: '600' },
    highlight: { color: '#10B981', fontSize: 15, fontWeight: '700' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        padding: 16,
        gap: 14,
    },

    // ── Info Card ──
    infoCard: {
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        ...Platform.select({
            ios: {
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.3 : 0.1,
                shadowRadius: 16,
            },
            android: { elevation: 5 },
        }),
    },
    cardAccent: {
        height: 4,
        backgroundColor: '#3B82F6',
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        paddingBottom: 14,
        gap: 14,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#3B82F6',
    },
    cardInfo: { flex: 1 },
    studentName: {
        fontSize: 17,
        fontWeight: '700',
        color: isDark ? '#F9FAFB' : '#111827',
        marginBottom: 6,
    },
    tagRow: { flexDirection: 'row', gap: 6 },
    tag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6',
    },
    tagBlue: {
        backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF',
    },
    tagText: {
        fontSize: 11,
        fontWeight: '700',
        color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280',
        letterSpacing: 0.3,
    },
    dueRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        marginHorizontal: 18,
        paddingVertical: 14,
    },
    dueBlock: { flex: 1, alignItems: 'center' },
    dueSep: {
        width: 1,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    dueLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
        marginBottom: 4,
    },
    dueValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#EF4444',
    },

    // ── Form ──
    form: {
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        gap: 4,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.3 : 0.06,
                shadowRadius: 12,
            },
            android: { elevation: 3 },
        }),
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: isDark ? '#F9FAFB' : '#111827',
        marginBottom: 16,
        letterSpacing: 0.2,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        color: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280',
        marginBottom: 8,
        textTransform: 'uppercase',
    },

    // ── Amount Input ──
    amountBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
        borderRadius: 14,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    amountBoxFocused: {
        borderColor: '#3B82F6',
        backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#F0F7FF',
    },
    amountBoxError: {
        borderColor: '#EF4444',
        backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : '#FFF5F5',
    },
    rupeeSymbol: {
        fontSize: 22,
        fontWeight: '700',
        color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        fontSize: 32,
        fontWeight: '800',
        color: isDark ? '#F9FAFB' : '#111827',
        paddingVertical: 14,
    },
    fullPayBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    fullPayText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.8,
    },
    errorHint: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
        marginTop: -6,
        marginBottom: 10,
    },

    // ── Chips ──
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    chip: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipActive: {
        backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
        borderColor: '#3B82F6',
    },
    chipText: {
        fontSize: 12,
        fontWeight: '700',
        color: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280',
    },
    chipTextActive: {
        color: '#3B82F6',
    },

    // ── Mode Row ──
    modeRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },

    // ── Remarks ──
    remarksInput: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#CBD5E1',
        borderRadius: 14,
        padding: 14,
        fontSize: 14,
        color: isDark ? '#F9FAFB' : '#111827',
        height: 80,
        textAlignVertical: 'top',
        marginBottom: 4,
    },

    // ── Summary ──
    summaryCard: {
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    },

    // ── Pay Button ──
    payBtn: {
        backgroundColor: '#10B981',
        paddingVertical: 17,
        borderRadius: 16,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
            },
            android: { elevation: 6 },
        }),
    },
    payBtnDisabled: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
        shadowOpacity: 0,
        elevation: 0,
    },
    payBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    payBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    payBtnArrow: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 18,
        fontWeight: '600',
    },
    errorBanner: {
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    errorBannerText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
    },
    upiQrSection: {
        marginBottom: 12,
        padding: 18,
        borderRadius: 18,
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FDE68A',
    },
    upiQrTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: isDark ? '#FBBF24' : '#B45309',
        marginBottom: 6,
    },
    upiQrSub: {
        fontSize: 13,
        lineHeight: 19,
        color: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280',
        marginBottom: 16,
    },
    upiQrCenter: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    upiQrMuted: { fontSize: 13, color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280' },
    upiQrWarn: { paddingVertical: 8 },
    upiQrWarnText: { fontSize: 13, lineHeight: 20, color: '#F87171', fontWeight: '600' },
    upiQrLink: { marginTop: 10, fontSize: 13, fontWeight: '700', color: '#3B82F6' },
    upiQrFrame: {
        alignSelf: 'center',
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 14,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
            android: { elevation: 4 },
            default: {},
        }),
    },
    upiQrMeta: { marginBottom: 12, gap: 6 },
    upiQrMetaLine: { fontSize: 13, color: isDark ? '#E5E7EB' : '#374151', fontWeight: '600' },
    upiQrMetaLab: { fontWeight: '700', color: isDark ? 'rgba(251,191,36,0.9)' : '#B45309' },
    upiShareBtn: {
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF',
        marginBottom: 12,
    },
    upiShareBtnText: { fontSize: 13, fontWeight: '800', color: '#3B82F6' },
    upiLedgerHint: {
        fontSize: 12,
        lineHeight: 18,
        color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280',
        fontStyle: 'italic' as const,
    },
});