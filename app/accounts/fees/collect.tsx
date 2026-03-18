import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, Alert, Animated, Easing, Pressable, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAuth } from '../../../src/hooks/useAuth';
import { FeeService as FeesService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import { generateReceiptPDF } from '../../../src/utils/pdfGenerator';
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
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState('Cash');
    const [remarks, setRemarks] = useState('');
    const [focused, setFocused] = useState(false);

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

    const dueNum = parseFloat(dueAmount) || 0;
    const amountNum = parseFloat(amount) || 0;
    const remaining = Math.max(0, dueNum - amountNum);
    const isOverpay = amountNum > dueNum && dueNum > 0;
    const isReady = amountNum > 0 && !isOverpay;

    const handleCollect = async () => {
        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount greater than zero.');
            return;
        }
        if (!isNaN(dueNum) && amountNum > dueNum) {
            Alert.alert('Overpayment', `₹${amountNum} exceeds due amount ₹${dueNum}.`);
            return;
        }
        if (amountNum > 1000000) {
            Alert.alert('Invalid Amount', 'Amount exceeds maximum limit of ₹10,00,000.');
            return;
        }
        if (!feeId) {
            Alert.alert('Error', 'Fee record identifier is missing.');
            return;
        }

        Alert.alert(
            'Confirm Payment',
            `Record ₹${amountNum.toLocaleString('en-IN')} via ${mode}?\n\nThis action is permanent and will be logged.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm & Record',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const result = await FeesService.collectFee({
                                student_fee_id: feeId,
                                amount: amountNum,
                                payment_method: mode.toLowerCase() as any,
                                transaction_ref: generateUUID(),
                                remarks,
                            });
                            Alert.alert(
                                '✓ Payment Recorded',
                                `Ref: ${result.transaction_ref || result.id}\n\nLedger updated successfully.`,
                                [
                                    {
                                        text: 'Print Receipt',
                                        onPress: async () => {
                                            await generateReceiptPDF({
                                                ...result,
                                                student_name: studentName,
                                                admission_no: admissionNo,
                                                fee_type: feeType,
                                                paid_at: new Date().toISOString(),
                                            });
                                            router.back();
                                        },
                                    },
                                    { text: 'Done', onPress: () => router.back() },
                                ]
                            );
                        } catch (error: any) {
                            Alert.alert(
                                'Payment Failed',
                                error.message || 'Could not process payment. Check backend logs.'
                            );
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <AdminHeader title="Collect Fee" showBackButton={true} />

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
                        <TextInput
                            style={styles.amountInput}
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="0"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
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
                                        onPress={() => setAmount(String(val))}
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
                                onPress={() => setMode(m.id)}
                                theme={theme}
                                isDark={isDark}
                            />
                        ))}
                    </View>

                    {/* Remarks */}
                    <Text style={styles.inputLabel}>Remarks</Text>
                    <TextInput
                        style={styles.remarksInput}
                        multiline
                        value={remarks}
                        onChangeText={setRemarks}
                        placeholder="e.g. Receipt no. 1234, partial for Q1…"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
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

                    <TouchableOpacity
                        style={[styles.payBtn, (!isReady || loading) && styles.payBtnDisabled]}
                        onPress={handleCollect}
                        disabled={!isReady || loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <LogoLoader color="#fff" />
                        ) : (
                            <View style={styles.payBtnInner}>
                                <Text style={styles.payBtnText}>
                                    {isReady
                                        ? `Collect ₹${amountNum.toLocaleString('en-IN')}`
                                        : 'Enter Amount to Continue'}
                                </Text>
                                {isReady && <Text style={styles.payBtnArrow}>→</Text>}
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
        backgroundColor: isDark ? '#0F1117' : '#F3F4F8',
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
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
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
});