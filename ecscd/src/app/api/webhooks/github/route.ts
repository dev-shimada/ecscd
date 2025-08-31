import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// GitHub webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');

    // Verify webhook signature (in production, use a proper secret)
    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')}`;

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);

    if (event === 'push') {
      // Handle push events
      const { repository, ref, commits } = payload;
      
      console.log(`Push event received for ${repository.full_name} on ${ref}`);
      console.log(`${commits.length} commits pushed`);

      // In a real implementation, you would:
      // 1. Check if the push affects any monitored task definition files
      // 2. Trigger automatic sync if auto-sync is enabled
      // 3. Update application status
      
      // For demo purposes, just log the event
      return NextResponse.json({
        message: 'Push event processed',
        repository: repository.full_name,
        branch: ref,
        commits: commits.length
      });
    }

    if (event === 'pull_request') {
      // Handle pull request events
      const { action, pull_request, repository } = payload;
      
      console.log(`PR event: ${action} for ${repository.full_name}#${pull_request.number}`);

      return NextResponse.json({
        message: 'Pull request event processed',
        action,
        repository: repository.full_name,
        pr: pull_request.number
      });
    }

    return NextResponse.json({
      message: 'Event received but not processed',
      event
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}