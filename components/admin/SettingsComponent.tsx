'use client';

import { FC, useEffect, useState } from 'react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '../ui/form';
import { useForm } from 'react-hook-form';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose
} from '../ui/dialog';
import { Save, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { toast } from 'sonner';
import { Button } from '../ui/button';

export const SettingsComponent: FC = () => {
  const [autoDeleteDays, setAutoDeleteDays] = useState(0);

  const form = useForm<{
    autoDeleteDays: number;
  }>({
    defaultValues: {
      autoDeleteDays: autoDeleteDays || 1
    }
  });

  const getSettings = async () => {
    const response = await fetch('/api/admin/settings');
    if (response.ok) {
      const data = await response.json();
      setAutoDeleteDays(data.autoDeletionDays);
    }
  };

  const updateSettings = async (autoDeleteDays: number) => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoDeleteDays
        })
      });
      if (response.ok) {
        await getSettings();
        toast.success('Settings updated successfully!');
      }
    } catch (error: any) {
      toast.error('Some error occurred!', {
        description: error.message || 'Something went wrong'
      });
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Auto-Delete</CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className="p-1 rounded hover:bg-muted">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Auto Delete</DialogTitle>
              <DialogDescription>
                Set the number of days after which user chats will be
                automatically deleted.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(async values => {
                  await updateSettings(values.autoDeleteDays);
                })}
              >
                <FormField
                  control={form.control}
                  name="autoDeleteDays"
                  render={({ field }) => (
                    <FormItem>
                      {+field.value !== 0 ? (
                        <>
                          <FormLabel>Auto Delete Days</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={60} {...field} />
                          </FormControl>

                          <FormDescription>
                            No. of days after chats delete
                          </FormDescription>
                        </>
                      ) : null}
                      <FormField
                        control={form.control}
                        name="autoDeleteDays"
                        render={({ field }) => (
                          <FormItem className="flex gap-2 items-center space-y-0">
                            <FormControl>
                              <Checkbox
                                {...field}
                                checked={+field.value === 0}
                                onCheckedChange={checked => {
                                  return checked
                                    ? field.onChange(0)
                                    : field.onChange(1);
                                }}
                              />
                            </FormControl>
                            <FormLabel>Don&apos;t auto delete</FormLabel>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose>
                    <Button type="submit" className="float-right">
                      <Save />
                      Save
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {autoDeleteDays ? `${autoDeleteDays} days` : `No auto deletion`}
        </div>
        <p className="text-xs text-muted-foreground">Current setting</p>
      </CardContent>
    </Card>
  );
};
