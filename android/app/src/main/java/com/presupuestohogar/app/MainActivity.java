package com.presupuestohogar.app;

import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_CREDENTIAL_REQUEST = 7312;
    private static final long LOCK_AFTER_INACTIVITY_MS = 60 * 1000;

    private boolean isUnlocked = false;
    private boolean unlockPromptShowing = false;
    private boolean lockSetupDialogShowing = false;
    private long backgroundedAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        super.onCreate(savedInstanceState);
        hideAppContent();
        requestDeviceUnlock(true);
    }

    @Override
    public void onResume() {
        super.onResume();
        requestDeviceUnlock(!isUnlocked || shouldLockAfterInactivity());
    }

    @Override
    public void onPause() {
        super.onPause();
        if (!unlockPromptShowing) {
            backgroundedAt = System.currentTimeMillis();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != DEVICE_CREDENTIAL_REQUEST) {
            return;
        }

        unlockPromptShowing = false;
        if (resultCode == RESULT_OK) {
            isUnlocked = true;
            backgroundedAt = 0L;
            showAppContent();
            return;
        }

        closeApp();
    }

    private void requestDeviceUnlock(boolean force) {
        if (!force || unlockPromptShowing || lockSetupDialogShowing) {
            return;
        }

        hideAppContent();

        KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (keyguardManager == null || !keyguardManager.isDeviceSecure()) {
            showDeviceLockRequiredDialog();
            return;
        }

        Intent unlockIntent = keyguardManager.createConfirmDeviceCredentialIntent(
                getString(R.string.app_lock_title),
                getString(R.string.app_lock_message)
        );

        if (unlockIntent == null) {
            isUnlocked = true;
            showAppContent();
            return;
        }

        unlockPromptShowing = true;
        startActivityForResult(unlockIntent, DEVICE_CREDENTIAL_REQUEST);
    }

    private boolean shouldLockAfterInactivity() {
        return isUnlocked &&
                backgroundedAt > 0L &&
                System.currentTimeMillis() - backgroundedAt >= LOCK_AFTER_INACTIVITY_MS;
    }

    private void showDeviceLockRequiredDialog() {
        if (isFinishing() || lockSetupDialogShowing) {
            return;
        }

        lockSetupDialogShowing = true;
        new AlertDialog.Builder(this)
                .setTitle(R.string.app_lock_setup_title)
                .setMessage(R.string.app_lock_setup_message)
                .setCancelable(false)
                .setPositiveButton(R.string.app_lock_setup_action, (dialog, which) -> {
                    lockSetupDialogShowing = false;
                    backgroundedAt = System.currentTimeMillis();
                    startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
                })
                .setNegativeButton(R.string.app_lock_close_action, (dialog, which) -> {
                    lockSetupDialogShowing = false;
                    closeApp();
                })
                .show();
    }

    private void closeApp() {
        isUnlocked = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    private void hideAppContent() {
        View content = findViewById(android.R.id.content);
        if (content != null) {
            content.setVisibility(View.INVISIBLE);
        }
    }

    private void showAppContent() {
        View content = findViewById(android.R.id.content);
        if (content != null) {
            content.setVisibility(View.VISIBLE);
        }
    }
}
